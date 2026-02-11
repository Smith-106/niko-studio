"""
BaseAgent Tests

Tests for the abstract BaseAgent: token counting, cost estimation,
budget checking, usage tracking, and prompt construction.
"""

import pytest
from src.agents.base import (
    BaseAgent,
    TokenUsage,
    BudgetConfig,
    BudgetExceededError,
    ModelPricing,
    ModelProvider,
    MODEL_PRICING,
)


class ConcreteAgent(BaseAgent):
    """Concrete implementation of BaseAgent for testing."""
    def run(self, input_data):
        return input_data


class TestTokenUsage:
    """Tests for TokenUsage dataclass"""

    def test_to_dict(self):
        usage = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.01)
        d = usage.to_dict()
        assert d["input_tokens"] == 100
        assert d["output_tokens"] == 50
        assert d["total_tokens"] == 150
        assert d["estimated_cost"] == 0.01
        assert "timestamp" in d


class TestModelPricing:
    """Tests for MODEL_PRICING"""

    def test_gpt4o_exists(self):
        assert "gpt-4o" in MODEL_PRICING
        pricing = MODEL_PRICING["gpt-4o"]
        assert pricing.input_cost == 2.5
        assert pricing.output_cost == 10.0
        assert pricing.provider == ModelProvider.OPENAI

    def test_local_model_free(self):
        assert MODEL_PRICING["local"].input_cost == 0.0
        assert MODEL_PRICING["local"].output_cost == 0.0


class TestCountTokens:
    """Tests for count_tokens()"""

    def test_english_text(self):
        agent = ConcreteAgent("test")
        count = agent.count_tokens("Hello world")
        assert count > 0
        assert isinstance(count, int)

    def test_chinese_text(self):
        agent = ConcreteAgent("test")
        count = agent.count_tokens("你好世界")
        assert count > 0

    def test_empty_text(self):
        agent = ConcreteAgent("test")
        count = agent.count_tokens("")
        assert count == 0


class TestEstimateCost:
    """Tests for estimate_cost()"""

    def test_basic_estimation(self):
        agent = ConcreteAgent("test")
        usage = agent.estimate_cost("Hello world, this is a test")
        assert usage.input_tokens > 0
        assert usage.output_tokens > 0
        assert usage.estimated_cost > 0

    def test_with_estimated_output(self):
        agent = ConcreteAgent("test")
        usage = agent.estimate_cost("test", estimated_output_tokens=1000)
        assert usage.output_tokens == 1000

    def test_with_different_model(self):
        agent = ConcreteAgent("test")
        usage_expensive = agent.estimate_cost("test", model="gpt-4-turbo")
        usage_cheap = agent.estimate_cost("test", model="gpt-4o-mini")
        assert usage_expensive.estimated_cost > usage_cheap.estimated_cost

    def test_unknown_model_uses_gpt4o(self):
        agent = ConcreteAgent("test")
        usage = agent.estimate_cost("test", model="unknown-model")
        # Should fall back to gpt-4o pricing
        assert usage.estimated_cost > 0


class TestCheckBudget:
    """Tests for check_budget()"""

    def test_within_budget(self):
        agent = ConcreteAgent("test", config={"max_cost_per_request": 10.0})
        usage = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.01)
        ok, msg = agent.check_budget(usage)
        assert ok is True

    def test_exceeds_request_budget_raises(self):
        agent = ConcreteAgent("test", config={"max_cost_per_request": 0.001})
        usage = TokenUsage(input_tokens=100000, output_tokens=50000, total_tokens=150000, estimated_cost=1.0)
        with pytest.raises(BudgetExceededError):
            agent.check_budget(usage, raise_on_exceed=True)

    def test_exceeds_request_budget_no_raise(self):
        agent = ConcreteAgent("test", config={"max_cost_per_request": 0.001})
        usage = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=1.0)
        ok, msg = agent.check_budget(usage, raise_on_exceed=False)
        assert ok is False
        assert "exceeds limit" in msg

    def test_exceeds_session_budget(self):
        agent = ConcreteAgent("test", config={"max_cost_per_session": 0.05})
        agent._session_cost = 0.04
        usage = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.02)
        with pytest.raises(BudgetExceededError):
            agent.check_budget(usage)

    def test_exceeds_token_limit(self):
        agent = ConcreteAgent("test", config={"max_tokens_per_request": 100})
        usage = TokenUsage(input_tokens=80, output_tokens=50, total_tokens=130, estimated_cost=0.001)
        with pytest.raises(BudgetExceededError):
            agent.check_budget(usage)

    def test_warning_threshold(self):
        agent = ConcreteAgent("test", config={
            "max_cost_per_request": 1.0,
            "budget_warn_threshold": 0.8,
        })
        usage = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.85)
        ok, msg = agent.check_budget(usage)
        assert ok is True
        assert msg is not None  # Warning should be present


class TestUsageTracking:
    """Tests for record_usage(), get_usage_summary(), reset_session()"""

    def test_record_usage(self):
        agent = ConcreteAgent("test")
        usage = TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.01)
        agent.record_usage(usage)
        assert agent._session_cost == 0.01
        assert len(agent._usage_history) == 1

    def test_get_usage_summary(self):
        agent = ConcreteAgent("test")
        agent.record_usage(TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.01))
        agent.record_usage(TokenUsage(input_tokens=200, output_tokens=100, total_tokens=300, estimated_cost=0.02))
        summary = agent.get_usage_summary()
        assert summary["agent_name"] == "test"
        assert summary["request_count"] == 2
        assert summary["total_input_tokens"] == 300
        assert summary["total_output_tokens"] == 150
        assert summary["total_cost"] == pytest.approx(0.03)

    def test_reset_session(self):
        agent = ConcreteAgent("test")
        agent.record_usage(TokenUsage(input_tokens=100, output_tokens=50, total_tokens=150, estimated_cost=0.01))
        agent.reset_session()
        assert agent._session_cost == 0.0
        assert len(agent._usage_history) == 0


class TestConstructPrompt:
    """Tests for construct_prompt()"""

    def test_prompt_contains_all_fields(self):
        agent = ConcreteAgent("test")
        prompt = agent.construct_prompt(
            purpose="test purpose",
            task="test task",
            mode="analysis",
            context="test context",
            expected="test expected",
            rules="test rules",
        )
        assert "PURPOSE: test purpose" in prompt
        assert "TASK: test task" in prompt
        assert "MODE: analysis" in prompt
        assert "CONTEXT: test context" in prompt
        assert "EXPECTED: test expected" in prompt
        assert "RULES: test rules" in prompt


class TestLogActivity:
    """Tests for log_activity()"""

    def test_log_info(self):
        agent = ConcreteAgent("test")
        # Should not raise
        agent.log_activity("test message", "INFO")

    def test_log_warning(self):
        agent = ConcreteAgent("test")
        agent.log_activity("test warning", "WARNING")

    def test_log_error(self):
        agent = ConcreteAgent("test")
        agent.log_activity("test error", "ERROR")

    def test_log_debug(self):
        agent = ConcreteAgent("test")
        agent.log_activity("test debug", "DEBUG")
