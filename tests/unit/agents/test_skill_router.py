"""
Skill Router Tests

Tests for task-type routing, keyword routing, issue routing,
skill chains, and convenience functions.
"""

import pytest
from src.agents.skill_router import (
    SkillRouter,
    SkillRecommendation,
    TaskType,
    get_skills_for_task,
    get_skills_for_issue,
)


class TestRouteByTaskType:
    """Tests for route_by_task_type()"""

    def test_character_creation_returns_skills(self):
        router = SkillRouter()
        recs = router.route_by_task_type(TaskType.CHARACTER_CREATION)
        assert len(recs) > 0
        skill_ids = [r.skill_id for r in recs]
        assert "four-selves" in skill_ids
        assert "character-forge" in skill_ids

    def test_character_creation_priority_order(self):
        router = SkillRouter()
        recs = router.route_by_task_type(TaskType.CHARACTER_CREATION)
        priorities = [r.priority for r in recs]
        assert priorities == sorted(priorities)

    def test_max_skills_limits_results(self):
        router = SkillRouter()
        recs = router.route_by_task_type(TaskType.CHARACTER_CREATION, max_skills=1)
        assert len(recs) == 1

    def test_unknown_task_type_returns_empty(self):
        router = SkillRouter()
        recs = router.route_by_task_type("unknown_task_type")
        assert recs == []

    def test_recommendation_fields(self):
        router = SkillRouter()
        recs = router.route_by_task_type(TaskType.SUSPENSE_BUILD)
        rec = recs[0]
        assert isinstance(rec, SkillRecommendation)
        assert rec.skill_id != ""
        assert rec.skill_name != ""
        assert 0 <= rec.relevance <= 1
        assert rec.priority >= 1

    def test_all_task_types_have_mappings(self):
        router = SkillRouter()
        for task_type in TaskType:
            recs = router.route_by_task_type(task_type)
            assert isinstance(recs, list)

    def test_chapter_writing_returns_multiple(self):
        router = SkillRouter()
        recs = router.route_by_task_type(TaskType.CHAPTER_WRITING)
        assert len(recs) >= 3
        skill_ids = [r.skill_id for r in recs]
        assert "novel-chapter" in skill_ids
        assert "show-dont-tell" in skill_ids

    def test_climax_writing_includes_true_character(self):
        router = SkillRouter()
        recs = router.route_by_task_type(TaskType.CLIMAX_WRITING)
        skill_ids = [r.skill_id for r in recs]
        assert "true-character" in skill_ids


class TestRouteByKeywords:
    """Tests for route_by_keywords()"""

    def test_single_keyword_match(self):
        router = SkillRouter()
        recs = router.route_by_keywords(["悬念"])
        assert len(recs) > 0
        skill_ids = [r.skill_id for r in recs]
        assert "suspense-craft" in skill_ids

    def test_multiple_keywords_match(self):
        router = SkillRouter()
        recs = router.route_by_keywords(["角色", "内心", "矛盾"])
        assert len(recs) > 0
        skill_ids = [r.skill_id for r in recs]
        assert "four-selves" in skill_ids

    def test_no_keywords_match_returns_empty(self):
        router = SkillRouter()
        recs = router.route_by_keywords(["zzzznonexistent"])
        assert len(recs) == 0

    def test_max_skills_limits_results(self):
        router = SkillRouter()
        recs = router.route_by_keywords(["角色", "对话", "悬念"], max_skills=2)
        assert len(recs) <= 2

    def test_relevance_sorted_descending(self):
        router = SkillRouter()
        recs = router.route_by_keywords(["角色", "矛盾", "层次"])
        if len(recs) > 1:
            relevances = [r.relevance for r in recs]
            assert relevances == sorted(relevances, reverse=True)

    def test_priority_increments(self):
        router = SkillRouter()
        recs = router.route_by_keywords(["对话", "潜台词"])
        priorities = [r.priority for r in recs]
        assert priorities == list(range(1, len(priorities) + 1))


class TestRouteByIssue:
    """Tests for route_by_issue()"""

    def test_direct_issue_match(self):
        router = SkillRouter()
        recs = router.route_by_issue("直白对白")
        assert len(recs) > 0
        skill_ids = [r.skill_id for r in recs]
        assert "on-the-nose-fix" in skill_ids

    def test_partial_issue_match(self):
        router = SkillRouter()
        recs = router.route_by_issue("这段文字存在机械降神的问题")
        assert len(recs) > 0
        skill_ids = [r.skill_id for r in recs]
        assert "deus-ex-machina" in skill_ids

    def test_no_match_returns_empty(self):
        router = SkillRouter()
        recs = router.route_by_issue("这是一个完美的段落")
        assert len(recs) == 0

    def test_multiple_issue_types(self):
        router = SkillRouter()
        # "人物扁平" maps to CHARACTER_CREATION + CHARACTER_DEVELOPMENT
        # "缺乏悬念" maps to SUSPENSE_BUILD
        recs_flat = router.route_by_issue("人物扁平")
        recs_suspense = router.route_by_issue("缺乏悬念")
        assert len(recs_flat) > 0
        assert len(recs_suspense) > 0
        flat_ids = [r.skill_id for r in recs_flat]
        suspense_ids = [r.skill_id for r in recs_suspense]
        has_character = any(sid in flat_ids for sid in ["four-selves", "character-forge", "true-character"])
        has_suspense = any(sid in suspense_ids for sid in ["suspense-craft", "misdirection-twist"])
        assert has_character
        assert has_suspense

    def test_deduplication(self):
        router = SkillRouter()
        recs = router.route_by_issue("人物扁平")
        skill_ids = [r.skill_id for r in recs]
        assert len(skill_ids) == len(set(skill_ids))

    def test_max_5_results(self):
        router = SkillRouter()
        recs = router.route_by_issue("人物扁平且缺乏悬念且描写抽象且反转无力")
        assert len(recs) <= 5


class TestGetSkillChain:
    """Tests for get_skill_chain()"""

    def test_character_creation_chain(self):
        router = SkillRouter()
        chain = router.get_skill_chain(TaskType.CHARACTER_CREATION)
        assert len(chain) == 3
        assert chain[0].skill_id == "character-forge"
        assert chain[1].skill_id == "four-selves"
        assert chain[2].skill_id == "mirror-foil"

    def test_chain_priority_increments(self):
        router = SkillRouter()
        chain = router.get_skill_chain(TaskType.CHAPTER_WRITING)
        priorities = [r.priority for r in chain]
        assert priorities == list(range(1, len(priorities) + 1))

    def test_chain_relevance_is_1(self):
        router = SkillRouter()
        chain = router.get_skill_chain(TaskType.QUALITY_REVIEW)
        for rec in chain:
            assert rec.relevance == 1.0

    def test_unmapped_task_returns_empty(self):
        router = SkillRouter()
        chain = router.get_skill_chain(TaskType.DIALOGUE_FIX)
        assert chain == []

    def test_chain_reason_contains_step_number(self):
        router = SkillRouter()
        chain = router.get_skill_chain(TaskType.CLIMAX_WRITING)
        for i, rec in enumerate(chain):
            assert f"第{i+1}步" in rec.reason


class TestListAllSkills:
    """Tests for list_all_skills()"""

    def test_returns_dict(self):
        router = SkillRouter()
        skills = router.list_all_skills()
        assert isinstance(skills, dict)
        assert len(skills) > 10

    def test_returns_copy(self):
        router = SkillRouter()
        skills = router.list_all_skills()
        skills["test-skill"] = {"name": "test"}
        assert "test-skill" not in router.SKILL_REGISTRY

    def test_all_skills_have_required_fields(self):
        router = SkillRouter()
        skills = router.list_all_skills()
        for skill_id, info in skills.items():
            assert "name" in info, f"{skill_id} missing name"
            assert "description" in info, f"{skill_id} missing description"
            assert "keywords" in info, f"{skill_id} missing keywords"


class TestConvenienceFunctions:
    """Tests for get_skills_for_task() and get_skills_for_issue()"""

    def test_get_skills_for_task(self):
        recs = get_skills_for_task(TaskType.STORY_OUTLINE)
        assert len(recs) > 0
        assert recs[0].skill_id == "22-steps-outline"

    def test_get_skills_for_issue(self):
        recs = get_skills_for_issue("陈词滥调")
        assert len(recs) > 0
        skill_ids = [r.skill_id for r in recs]
        assert "script-doctor" in skill_ids
