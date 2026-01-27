
import pytest
from unittest.mock import MagicMock
from agents.critic import CriticAgent, CriticOutput, DimensionScore

class TestCriticAgent:
    @pytest.fixture
    def agent(self):
        mock_llm = MagicMock()
        return CriticAgent(mock_llm)

    @pytest.fixture
    def basic_result(self):
        return CriticOutput(
            total_score=85,
            lock_score=35,
            style_score=30,
            logic_score=20,
            decision="APPROVED",
            decision_reason="Good",
            dimension_details=[
                DimensionScore(dimension="dialogue_quality", score=8, weight=0.1, feedback="Good", issues=[])
            ],
            suggestions_high=[],
            suggestions_medium=[],
            suggestions_low=[],
            revision_instructions=[],
            actionable_feedback=""
        )

    def test_no_forbidden_words(self, agent, basic_result):
        content = "这是一个完全正常的句子，没有任何问题。"
        result = agent._apply_rule_checks(basic_result, content)

        # Should not have modified suggestions_high
        assert not any("禁用词" in s for s in result.suggestions_high)
        # Score should remain same
        assert result.dimension_details[0].score == 8

    def test_single_forbidden_word(self, agent, basic_result):
        # FORBIDDEN_WORDS = ["突然", "不禁", "竟然", "居然", "忍不住"]
        content = "他突然笑了起来。"
        result = agent._apply_rule_checks(basic_result, content)

        assert any("禁用词" in s for s in result.suggestions_high)
        assert "「突然」出现1次" in result.suggestions_high[0]
        # Check score deduction
        # Original score 8, 1 forbidden word found -> 7
        assert result.dimension_details[0].score == 7
        assert "「突然」出现1次" in result.dimension_details[0].issues

    def test_multiple_forbidden_words(self, agent, basic_result):
        content = "他突然笑了起来，不禁感到开心。"
        result = agent._apply_rule_checks(basic_result, content)

        assert any("禁用词" in s for s in result.suggestions_high)
        assert "「突然」出现1次" in result.suggestions_high[0]
        assert "「不禁」出现1次" in result.suggestions_high[0]
        # Check score deduction
        # Original score 8, 2 forbidden words found -> 6
        assert result.dimension_details[0].score == 6

    def test_repeated_forbidden_word(self, agent, basic_result):
        content = "突然，非常突然。"
        result = agent._apply_rule_checks(basic_result, content)

        assert any("禁用词" in s for s in result.suggestions_high)
        assert "「突然」出现2次" in result.suggestions_high[0]
        # Check score deduction
        # Original score 8, 1 forbidden word found (regardless of count? No, loop iterates unique words)
        # The code:
        # for word in self.FORBIDDEN_WORDS:
        #    if word in content: ... forbidden_found.append(...)
        # if forbidden_found: ... detail.score = max(0, detail.score - len(forbidden_found))
        # So it deducts based on number of unique forbidden words types found, not total count.

        assert result.dimension_details[0].score == 7

    def test_substring_match(self, agent, basic_result):
        # "突然" is forbidden. "突然袭击" contains "突然".
        content = "这是一个突然袭击。"
        result = agent._apply_rule_checks(basic_result, content)

        assert any("禁用词" in s for s in result.suggestions_high)
        assert "「突然」出现1次" in result.suggestions_high[0]
