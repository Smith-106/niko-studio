"""
Character Agent Tests

Tests for CharacterAgent: data models, dialogue guide generation,
relationship analysis, behavior validation, and context retrieval.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from src.agents.character import (
    CharacterAgent,
    CharacterProfile,
    CharacterContext,
)


class TestDataModels:
    """Tests for CharacterProfile and CharacterContext"""

    def test_character_profile_minimal(self):
        p = CharacterProfile(name="Alice")
        assert p.name == "Alice"
        assert p.role == ""
        assert p.relationships == {}
        assert p.mannerisms == []

    def test_character_profile_full(self):
        p = CharacterProfile(
            name="Klein",
            role="protagonist",
            social_self="Gentleman",
            personal_self="Cautious detective",
            private_self="Lonely traveler",
            hidden_self="Bearer of secrets",
            desire="Find truth",
            fear="Losing identity",
            flaw="Overthinks",
            strength="Deduction",
            appearance="Brown hair, gray eyes",
            speech_pattern="Formal, measured",
            mannerisms=["adjusts cufflinks", "taps fingers"],
            relationships={"Dunn": "FRIEND", "Ince": "ENEMY"},
        )
        assert p.role == "protagonist"
        assert len(p.mannerisms) == 2
        assert p.relationships["Dunn"] == "FRIEND"

    def test_character_context_defaults(self):
        ctx = CharacterContext()
        assert ctx.main_character is None
        assert ctx.present_characters == []
        assert ctx.relationship_dynamics == []
        assert ctx.dialogue_guidelines == {}


class TestGenerateDialogueGuide:
    """Tests for _generate_dialogue_guide()"""

    def test_with_speech_pattern(self):
        agent = CharacterAgent()
        profile = CharacterProfile(
            name="Test",
            speech_pattern="formal and measured",
        )
        guide = agent._generate_dialogue_guide(profile)
        assert "formal and measured" in guide

    def test_with_mannerisms(self):
        agent = CharacterAgent()
        profile = CharacterProfile(
            name="Test",
            mannerisms=["taps fingers", "sighs", "paces"],
        )
        guide = agent._generate_dialogue_guide(profile)
        assert "taps fingers" in guide

    def test_with_social_self(self):
        agent = CharacterAgent()
        profile = CharacterProfile(
            name="Test",
            social_self="Confident leader",
        )
        guide = agent._generate_dialogue_guide(profile)
        assert "Confident leader" in guide

    def test_with_private_self(self):
        agent = CharacterAgent()
        profile = CharacterProfile(
            name="Test",
            private_self="Secretly afraid",
        )
        guide = agent._generate_dialogue_guide(profile)
        assert "Secretly afraid" in guide

    def test_empty_profile_default_guide(self):
        agent = CharacterAgent()
        profile = CharacterProfile(name="Empty")
        guide = agent._generate_dialogue_guide(profile)
        assert guide == "无特殊指南"

    def test_mannerisms_limited_to_3(self):
        agent = CharacterAgent()
        profile = CharacterProfile(
            name="Test",
            mannerisms=["m1", "m2", "m3", "m4", "m5"],
        )
        guide = agent._generate_dialogue_guide(profile)
        assert "m4" not in guide


class TestAnalyzeRelationships:
    """Tests for _analyze_relationships()"""

    @pytest.mark.asyncio
    async def test_enemy_relationship(self):
        agent = CharacterAgent()
        main = CharacterProfile(
            name="Hero",
            relationships={"Villain": "ENEMY"},
        )
        others = [CharacterProfile(name="Villain")]
        dynamics = await agent._analyze_relationships(main, others)
        assert len(dynamics) == 1
        assert "对立" in dynamics[0]

    @pytest.mark.asyncio
    async def test_friend_relationship(self):
        agent = CharacterAgent()
        main = CharacterProfile(
            name="Hero",
            relationships={"Sidekick": "FRIEND"},
        )
        others = [CharacterProfile(name="Sidekick")]
        dynamics = await agent._analyze_relationships(main, others)
        assert "亲密" in dynamics[0]

    @pytest.mark.asyncio
    async def test_mentor_relationship(self):
        agent = CharacterAgent()
        main = CharacterProfile(
            name="Student",
            relationships={"Master": "MENTOR"},
        )
        others = [CharacterProfile(name="Master")]
        dynamics = await agent._analyze_relationships(main, others)
        assert "师徒" in dynamics[0]

    @pytest.mark.asyncio
    async def test_neutral_relationship(self):
        agent = CharacterAgent()
        main = CharacterProfile(name="Hero")
        others = [CharacterProfile(name="Stranger")]
        dynamics = await agent._analyze_relationships(main, others)
        assert "中性" in dynamics[0]

    @pytest.mark.asyncio
    async def test_multiple_relationships(self):
        agent = CharacterAgent()
        main = CharacterProfile(
            name="Hero",
            relationships={"Friend": "ALLY", "Foe": "RIVAL"},
        )
        others = [
            CharacterProfile(name="Friend"),
            CharacterProfile(name="Foe"),
        ]
        dynamics = await agent._analyze_relationships(main, others)
        assert len(dynamics) == 2


class TestValidateBehavior:
    """Tests for validate_behavior()"""

    @pytest.mark.asyncio
    async def test_no_profile_found(self):
        agent = CharacterAgent()
        ctx = CharacterContext()
        result = await agent.validate_behavior("Ghost", "walks away", ctx)
        assert result["is_valid"] is True
        assert "角色档案未找到" in result["suggestions"][0]

    @pytest.mark.asyncio
    async def test_fear_in_action(self):
        agent = CharacterAgent()
        profile = CharacterProfile(name="Hero", fear="fire")
        ctx = CharacterContext(main_character=profile)
        result = await agent.validate_behavior("Hero", "walks into fire", ctx)
        assert len(result["issues"]) > 0
        assert "恐惧" in result["issues"][0]

    @pytest.mark.asyncio
    async def test_flaw_and_perfect_action(self):
        agent = CharacterAgent()
        profile = CharacterProfile(name="Hero", flaw="impatient")
        ctx = CharacterContext(main_character=profile)
        result = await agent.validate_behavior("Hero", "完美地完成了任务", ctx)
        assert len(result["issues"]) > 0
        assert "完美" in result["issues"][0]

    @pytest.mark.asyncio
    async def test_valid_behavior(self):
        agent = CharacterAgent()
        profile = CharacterProfile(name="Hero", fear="fire", flaw="impatient")
        ctx = CharacterContext(main_character=profile)
        result = await agent.validate_behavior("Hero", "cautiously enters the room", ctx)
        assert result["is_valid"] is True

    @pytest.mark.asyncio
    async def test_validate_present_character(self):
        agent = CharacterAgent()
        npc = CharacterProfile(name="NPC", fear="darkness")
        ctx = CharacterContext(present_characters=[npc])
        result = await agent.validate_behavior("NPC", "walks into darkness", ctx)
        assert len(result["issues"]) > 0


class TestGetContext:
    """Tests for get_context()"""

    @pytest.mark.asyncio
    async def test_no_graph_returns_basic_context(self):
        agent = CharacterAgent(graph_engine=None)
        ctx = await agent.get_context({
            "pov_character": "Hero",
            "characters": ["Sidekick"],
        })
        assert ctx.main_character is not None
        assert ctx.main_character.name == "Hero"
        assert len(ctx.present_characters) == 1

    @pytest.mark.asyncio
    async def test_pov_excluded_from_present(self):
        agent = CharacterAgent(graph_engine=None)
        ctx = await agent.get_context({
            "pov_character": "Hero",
            "characters": ["Hero", "Sidekick"],
        })
        present_names = [c.name for c in ctx.present_characters]
        assert "Hero" not in present_names
        assert "Sidekick" in present_names

    @pytest.mark.asyncio
    async def test_dialogue_guidelines_generated(self):
        agent = CharacterAgent(graph_engine=None)
        ctx = await agent.get_context({
            "pov_character": "Hero",
            "characters": ["Sidekick"],
        })
        assert "Hero" in ctx.dialogue_guidelines
        assert "Sidekick" in ctx.dialogue_guidelines

    @pytest.mark.asyncio
    async def test_empty_scene_info(self):
        agent = CharacterAgent(graph_engine=None)
        ctx = await agent.get_context({})
        assert ctx.main_character is None
        assert ctx.present_characters == []
