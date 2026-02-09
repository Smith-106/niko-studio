"""ResumeStrategy 单元测试"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from workflow.session.resume_strategy import (
    determine_resume_strategy,
    build_context_prefix,
    ResumeMode,
    ConversationTurn,
)


def test_determine_resume_strategy_single_append_prompt_concat_without_native_id():
    decision = determine_resume_strategy(
        tool="gemini",
        resume_ids=["conv-001"],
        custom_id=None,
    )

    assert decision.strategy == ResumeMode.PROMPT_CONCAT


def test_determine_resume_strategy_single_append_native_with_mapping():
    decision = determine_resume_strategy(
        tool="gemini",
        resume_ids=["conv-001"],
        custom_id=None,
        get_native_session_id=lambda session_id: session_id,
    )

    assert decision.strategy == ResumeMode.NATIVE
    assert decision.native_session_id == "conv-001"


def test_determine_resume_strategy_fork_prompt_concat():
    decision = determine_resume_strategy(
        tool="gemini",
        resume_ids=["conv-001"],
        custom_id="fork-001",
    )

    assert decision.strategy == ResumeMode.PROMPT_CONCAT
    assert decision.primary_conversation_id == "conv-001"


def test_determine_resume_strategy_multi_merge_hybrid():
    decision = determine_resume_strategy(
        tool="gemini",
        resume_ids=["conv-001", "conv-002"],
        custom_id=None,
    )

    assert decision.strategy == ResumeMode.HYBRID
    assert decision.primary_conversation_id == "conv-001"


def test_determine_resume_strategy_cross_tool_prompt_concat():
    decision = determine_resume_strategy(
        tool="claude",
        resume_ids=["conv-001"],
        custom_id=None,
        get_native_session_id=lambda session_id: session_id,
        get_conversation_tool=lambda session_id: "gemini",
    )

    assert decision.strategy == ResumeMode.PROMPT_CONCAT


def test_build_context_prefix_plain():
    turns = [
        ConversationTurn(role="user", content="Hello", timestamp=None),
        ConversationTurn(role="assistant", content="Hi", timestamp=None),
    ]

    prefix = build_context_prefix(turns, format="plain")

    assert "PREVIOUS CONVERSATION" in prefix
    assert "[USER]:" in prefix
    assert "Hello" in prefix


def test_build_context_prefix_yaml():
    turns = [
        ConversationTurn(role="user", content="Hello", timestamp=None),
    ]

    prefix = build_context_prefix(turns, format="yaml")

    assert "previous_conversation" in prefix
    assert "session_id" in prefix


def test_build_context_prefix_json():
    turns = [
        ConversationTurn(role="assistant", content="Hi", timestamp=None),
    ]

    prefix = build_context_prefix(turns, format="json")

    assert "previous_conversation" in prefix
    assert "session_id" in prefix
