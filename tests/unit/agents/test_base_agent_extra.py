"""Extra branch tests for BaseAgent."""

from unittest.mock import patch

from src.agents.base import BaseAgent, TokenUsage


class _FallbackAgent(BaseAgent):
    def run(self, input_data):
        return BaseAgent.run(self, input_data)


class _ConcreteAgent(BaseAgent):
    def run(self, input_data):
        return input_data


def test_get_tokenizer_fallback_and_count_tokens_approximation():
    with patch("tiktoken.get_encoding", side_effect=RuntimeError("no tokenizer")):
        agent = _ConcreteAgent("fallback")

    assert agent._tokenizer is None
    assert agent.count_tokens("abcdef") == 2


def test_check_budget_session_exceed_without_raise_returns_false():
    agent = _ConcreteAgent("budget", config={"max_cost_per_session": 0.05})
    agent._session_cost = 0.04
    usage = TokenUsage(input_tokens=1, output_tokens=1, total_tokens=2, estimated_cost=0.02)

    ok, msg = agent.check_budget(usage, raise_on_exceed=False)

    assert ok is False
    assert "Session cost" in msg


def test_check_budget_token_exceed_without_raise_returns_false():
    agent = _ConcreteAgent("budget", config={"max_tokens_per_request": 10})
    usage = TokenUsage(input_tokens=8, output_tokens=5, total_tokens=13, estimated_cost=0.001)

    ok, msg = agent.check_budget(usage, raise_on_exceed=False)

    assert ok is False
    assert "Token count" in msg


def test_check_budget_warns_for_projected_session_threshold_only():
    agent = _ConcreteAgent(
        "budget",
        config={"max_cost_per_request": 10.0, "max_cost_per_session": 1.0, "budget_warn_threshold": 0.8},
    )
    agent._session_cost = 0.79
    usage = TokenUsage(input_tokens=1, output_tokens=1, total_tokens=2, estimated_cost=0.05)

    ok, msg = agent.check_budget(usage)

    assert ok is True
    assert msg is not None
    assert "Session approaching cost limit" in msg


def test_abstract_base_run_pass_line_executes_via_super_call():
    agent = _FallbackAgent("fallback")

    assert agent.run({"k": "v"}) is None
