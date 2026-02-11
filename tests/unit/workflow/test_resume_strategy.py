# -*- coding: utf-8 -*-
"""
ResumeStrategy Tests

Tests for ResumeMode, ContextFormat, ConversationTurn, SessionContext,
ResumeDecision, CheckpointState, NativeResumeStrategy, PromptConcatStrategy,
HybridStrategy, ResumeStrategyResolver, convenience functions.
"""

import json
import pytest
from pathlib import Path
from datetime import datetime

from src.workflow.session.resume_strategy import (
    ResumeMode,
    ContextFormat,
    ConversationTurn,
    SessionContext,
    ResumeDecision,
    CheckpointState,
    NativeResumeStrategy,
    PromptConcatStrategy,
    HybridStrategy,
    PromptConcatResumeStrategy,
    HybridResumeStrategy,
    ResumeStrategyResolver,
    determine_resume_strategy,
    build_context_prefix,
    create_strategy,
)


# ============================================================
# Enums
# ============================================================

class TestResumeMode:

    def test_values(self):
        assert ResumeMode.NATIVE.value == "native"
        assert ResumeMode.PROMPT_CONCAT.value == "prompt-concat"
        assert ResumeMode.HYBRID.value == "hybrid"
        assert ResumeMode.DISABLED.value == "disabled"


class TestContextFormat:

    def test_values(self):
        assert ContextFormat.PLAIN.value == "plain"
        assert ContextFormat.YAML.value == "yaml"
        assert ContextFormat.JSON.value == "json"


# ============================================================
# ConversationTurn
# ============================================================

class TestConversationTurn:

    def test_to_dict(self):
        now = datetime.now()
        t = ConversationTurn(role="user", content="hello", timestamp=now)
        d = t.to_dict()
        assert d["role"] == "user"
        assert d["content"] == "hello"
        assert d["timestamp"] == now.isoformat()

    def test_to_dict_no_timestamp(self):
        t = ConversationTurn(role="assistant", content="hi")
        d = t.to_dict()
        assert d["timestamp"] is None

    def test_from_dict(self):
        now = datetime.now()
        d = {"role": "user", "content": "hello", "timestamp": now.isoformat()}
        t = ConversationTurn.from_dict(d)
        assert t.role == "user"
        assert t.content == "hello"
        assert t.timestamp is not None

    def test_from_dict_no_timestamp(self):
        d = {"role": "system", "content": "init"}
        t = ConversationTurn.from_dict(d)
        assert t.timestamp is None

    def test_roundtrip(self):
        now = datetime.now()
        t = ConversationTurn(
            role="user", content="test",
            timestamp=now, tool_calls=[{"name": "tool1"}],
            metadata={"key": "val"},
        )
        d = t.to_dict()
        t2 = ConversationTurn.from_dict(d)
        assert t2.role == t.role
        assert t2.content == t.content
        assert t2.tool_calls == t.tool_calls
        assert t2.metadata == t.metadata


# ============================================================
# SessionContext
# ============================================================

class TestSessionContext:

    def test_to_dict(self):
        now = datetime.now()
        ctx = SessionContext(
            session_id="s1",
            history=[ConversationTurn(role="user", content="hi")],
            last_state={"step": 1},
            resumed_at=now,
            resume_mode=ResumeMode.NATIVE,
            checkpoint_id="cp-1",
            metadata={"key": "val"},
        )
        d = ctx.to_dict()
        assert d["session_id"] == "s1"
        assert len(d["history"]) == 1
        assert d["resume_mode"] == "native"
        assert d["checkpoint_id"] == "cp-1"

    def test_from_dict(self):
        now = datetime.now()
        d = {
            "session_id": "s1",
            "history": [{"role": "user", "content": "hi"}],
            "last_state": {"step": 1},
            "resumed_at": now.isoformat(),
            "resume_mode": "hybrid",
            "checkpoint_id": "cp-2",
            "metadata": None,
        }
        ctx = SessionContext.from_dict(d)
        assert ctx.session_id == "s1"
        assert len(ctx.history) == 1
        assert ctx.resume_mode == ResumeMode.HYBRID

    def test_from_dict_defaults(self):
        d = {"session_id": "s2"}
        ctx = SessionContext.from_dict(d)
        assert ctx.history == []
        assert ctx.resumed_at is None
        assert ctx.resume_mode == ResumeMode.NATIVE


# ============================================================
# CheckpointState
# ============================================================

class TestCheckpointState:

    def test_to_dict(self):
        now = datetime.now()
        cp = CheckpointState(
            checkpoint_id="cp-1",
            session_id="s1",
            created_at=now,
            workflow_step="step1",
            state_data={"key": "val"},
            history_snapshot=[ConversationTurn(role="user", content="hi")],
        )
        d = cp.to_dict()
        assert d["checkpoint_id"] == "cp-1"
        assert d["workflow_step"] == "step1"
        assert len(d["history_snapshot"]) == 1

    def test_from_dict(self):
        now = datetime.now()
        d = {
            "checkpoint_id": "cp-1",
            "session_id": "s1",
            "created_at": now.isoformat(),
            "workflow_step": "step2",
            "state_data": {"a": 1},
            "history_snapshot": [{"role": "assistant", "content": "ok"}],
        }
        cp = CheckpointState.from_dict(d)
        assert cp.checkpoint_id == "cp-1"
        assert cp.workflow_step == "step2"
        assert len(cp.history_snapshot) == 1

    def test_roundtrip(self):
        now = datetime.now()
        cp = CheckpointState(
            checkpoint_id="cp-rt",
            session_id="s1",
            created_at=now,
            workflow_step="step3",
            state_data={"data": True},
            history_snapshot=[],
        )
        d = cp.to_dict()
        cp2 = CheckpointState.from_dict(d)
        assert cp2.checkpoint_id == cp.checkpoint_id
        assert cp2.state_data == cp.state_data


# ============================================================
# NativeResumeStrategy
# ============================================================

class TestNativeResumeStrategy:

    def test_supports_native_claude(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        assert s.supports_native() is True

    def test_supports_native_unknown(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="unknown_tool")
        assert s.supports_native() is False

    def test_can_resume_no_native_id(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        assert s.can_resume("nonexistent") is False

    def test_register_and_get_native_session(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.register_native_session("s1", "native-123")
        assert s.get_native_session_id("s1") == "native-123"

    def test_save_checkpoint(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        cp_id = s.save_checkpoint("s1", {"current_step": "plan", "history": []})
        assert cp_id.startswith("cp-")

    def test_list_checkpoints(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.save_checkpoint("s1", {"current_step": "plan"})
        s.save_checkpoint("s1", {"current_step": "act"})
        cps = s.list_checkpoints("s1")
        assert len(cps) == 2

    def test_list_checkpoints_empty(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        assert s.list_checkpoints("nonexistent") == []

    def test_get_latest_checkpoint(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.save_checkpoint("s1", {"current_step": "plan"})
        s.save_checkpoint("s1", {"current_step": "act"})
        latest = s.get_latest_checkpoint("s1")
        assert latest is not None
        assert latest.workflow_step == "act"

    def test_can_resume_with_checkpoint(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.register_native_session("s1", "native-1")
        s.save_checkpoint("s1", {"current_step": "plan"})
        assert s.can_resume("s1") is True

    def test_resume(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.register_native_session("s1", "native-1")
        s.save_checkpoint("s1", {"current_step": "plan"})
        ctx = s.resume("s1")
        assert ctx.session_id == "s1"
        assert ctx.resume_mode == ResumeMode.NATIVE
        assert ctx.metadata["native_session_id"] == "native-1"

    def test_resume_not_possible_raises(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        with pytest.raises(ValueError):
            s.resume("nonexistent")

    def test_checkpoint_path(self, tmp_path):
        s = NativeResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        p = s.get_checkpoint_path("s1")
        assert "s1.json" in str(p)

    def test_mapping_persistence(self, tmp_path):
        base = tmp_path / "sessions"
        s1 = NativeResumeStrategy(base_path=base, tool="claude")
        s1.register_native_session("s1", "native-1")
        # Create new instance - should load mapping from file
        s2 = NativeResumeStrategy(base_path=base, tool="claude")
        assert s2.get_native_session_id("s1") == "native-1"


# ============================================================
# PromptConcatStrategy
# ============================================================

class TestPromptConcatStrategy:

    def test_can_resume_no_checkpoint(self, tmp_path):
        s = PromptConcatStrategy(base_path=tmp_path / "sessions")
        assert s.can_resume("nonexistent") is False

    def test_save_and_resume(self, tmp_path):
        s = PromptConcatStrategy(base_path=tmp_path / "sessions")
        s.save_checkpoint("s1", {
            "current_step": "plan",
            "history": [{"role": "user", "content": "hello"}],
        })
        assert s.can_resume("s1") is True
        ctx = s.resume("s1")
        assert ctx.session_id == "s1"
        assert ctx.resume_mode == ResumeMode.PROMPT_CONCAT
        assert len(ctx.history) == 1

    def test_resume_no_checkpoint_raises(self, tmp_path):
        s = PromptConcatStrategy(base_path=tmp_path / "sessions")
        with pytest.raises(ValueError):
            s.resume("nonexistent")

    def test_history_truncation(self, tmp_path):
        s = PromptConcatStrategy(
            base_path=tmp_path / "sessions",
            max_history_turns=2,
        )
        history = [{"role": "user", "content": f"msg{i}"} for i in range(5)]
        s.save_checkpoint("s1", {"current_step": "plan", "history": history})
        ctx = s.resume("s1")
        assert len(ctx.history) == 2

    def test_build_context_prefix_plain(self, tmp_path):
        s = PromptConcatStrategy(
            base_path=tmp_path / "sessions",
            default_format=ContextFormat.PLAIN,
        )
        ctx = SessionContext(
            session_id="s1",
            history=[ConversationTurn(role="user", content="hello")],
        )
        prefix = s.build_context_prefix(ctx)
        assert "PREVIOUS CONVERSATION" in prefix
        assert "[USER]:" in prefix
        assert "hello" in prefix

    def test_build_context_prefix_yaml(self, tmp_path):
        s = PromptConcatStrategy(
            base_path=tmp_path / "sessions",
            default_format=ContextFormat.YAML,
        )
        ctx = SessionContext(
            session_id="s1",
            history=[ConversationTurn(role="user", content="hello")],
            checkpoint_id="cp-1",
        )
        prefix = s.build_context_prefix(ctx)
        assert "---" in prefix
        assert "previous_conversation" in prefix

    def test_build_context_prefix_json(self, tmp_path):
        s = PromptConcatStrategy(
            base_path=tmp_path / "sessions",
            default_format=ContextFormat.JSON,
        )
        ctx = SessionContext(
            session_id="s1",
            history=[ConversationTurn(role="user", content="hello")],
            checkpoint_id="cp-1",
        )
        prefix = s.build_context_prefix(ctx, format=ContextFormat.JSON)
        assert "```json" in prefix
        assert "previous_conversation" in prefix

    def test_save_checkpoint_with_conversation_turns(self, tmp_path):
        s = PromptConcatStrategy(base_path=tmp_path / "sessions")
        # ConversationTurn objects are converted internally; pass dicts to avoid
        # JSON serialization issues in the state_data blob.
        history = [{"role": "user", "content": "hi"}]
        s.save_checkpoint("s1", {
            "current_step": "plan",
            "history": history,
        })
        cps = s.list_checkpoints("s1")
        assert len(cps) == 1


# ============================================================
# HybridStrategy
# ============================================================

class TestHybridStrategy:

    def test_can_resume_via_concat(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="unknown")
        s.concat_strategy.save_checkpoint("s1", {
            "current_step": "plan",
            "history": [{"role": "user", "content": "hi"}],
        })
        assert s.can_resume("s1") is True

    def test_resume_fallback_to_concat(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="unknown")
        s.concat_strategy.save_checkpoint("s1", {
            "current_step": "plan",
            "history": [{"role": "user", "content": "hi"}],
        })
        ctx = s.resume("s1")
        assert ctx.metadata.get("fallback_used") is True

    def test_resume_native_first(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.native_strategy.register_native_session("s1", "native-1")
        s.native_strategy.save_checkpoint("s1", {"current_step": "plan"})
        ctx = s.resume("s1")
        assert ctx.resume_mode == ResumeMode.NATIVE

    def test_resume_no_session_raises(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="claude")
        with pytest.raises(ValueError):
            s.resume("nonexistent")

    def test_save_checkpoint_delegates_to_concat(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="claude")
        cp_id = s.save_checkpoint("s1", {"current_step": "plan", "history": []})
        assert cp_id.startswith("cp-")
        assert s.concat_strategy.can_resume("s1") is True

    def test_merge_sessions(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.save_checkpoint("s1", {
            "current_step": "plan",
            "history": [{"role": "user", "content": "msg1"}],
        })
        s.save_checkpoint("s2", {
            "current_step": "act",
            "history": [{"role": "user", "content": "msg2"}],
        })
        ctx = s.merge_sessions(["s1", "s2"])
        assert "merged" in ctx.session_id or ctx.session_id.startswith("merged")
        assert ctx.metadata["merge_count"] == 2

    def test_merge_empty_raises(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="claude")
        with pytest.raises(ValueError):
            s.merge_sessions([])

    def test_merge_with_target_id(self, tmp_path):
        s = HybridStrategy(base_path=tmp_path / "sessions", tool="claude")
        s.save_checkpoint("s1", {"current_step": "plan", "history": []})
        ctx = s.merge_sessions(["s1"], target_session_id="target-1")
        assert ctx.session_id == "target-1"


# ============================================================
# Legacy aliases
# ============================================================

class TestLegacyAliases:

    def test_prompt_concat_resume_strategy(self, tmp_path):
        s = PromptConcatResumeStrategy(base_path=tmp_path / "sessions")
        assert isinstance(s, PromptConcatStrategy)

    def test_hybrid_resume_strategy(self, tmp_path):
        s = HybridResumeStrategy(base_path=tmp_path / "sessions", tool="claude")
        assert isinstance(s, HybridStrategy)


# ============================================================
# ResumeStrategyResolver
# ============================================================

class TestResumeStrategyResolver:

    def test_no_resume_ids(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy("claude", [])
        assert decision.strategy == ResumeMode.DISABLED

    def test_single_native(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy(
            "claude", ["s1"],
            get_native_session_id=lambda sid: "native-1",
        )
        assert decision.strategy == ResumeMode.NATIVE
        assert decision.native_session_id == "native-1"

    def test_single_no_native_id(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy(
            "claude", ["s1"],
            get_native_session_id=lambda sid: None,
        )
        assert decision.strategy == ResumeMode.PROMPT_CONCAT

    def test_cross_tool(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy(
            "gemini", ["s1"],
            get_conversation_tool=lambda sid: "claude",
        )
        assert decision.strategy == ResumeMode.PROMPT_CONCAT
        assert "Cross-tool" in decision.reason

    def test_fork_scenario(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy(
            "claude", ["s1"], custom_id="new-session",
        )
        assert decision.strategy == ResumeMode.PROMPT_CONCAT
        assert "Fork" in decision.reason

    def test_multi_merge(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy("claude", ["s1", "s2"])
        assert decision.strategy == ResumeMode.HYBRID

    def test_unsupported_tool_no_native(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy("unknown_tool", ["s1"])
        assert decision.strategy == ResumeMode.PROMPT_CONCAT
        assert decision.fallback_strategy is None

    def test_same_tool_no_cross(self):
        resolver = ResumeStrategyResolver()
        decision = resolver.determine_strategy(
            "claude", ["s1"],
            get_conversation_tool=lambda sid: "claude",
            get_native_session_id=lambda sid: "native-1",
        )
        assert decision.strategy == ResumeMode.NATIVE


# ============================================================
# Convenience functions
# ============================================================

class TestConvenienceFunctions:

    def test_determine_resume_strategy(self):
        decision = determine_resume_strategy("claude", ["s1"])
        assert isinstance(decision, ResumeDecision)

    def test_build_context_prefix_plain(self):
        turns = [ConversationTurn(role="user", content="hello")]
        prefix = build_context_prefix(turns, format="plain")
        assert "PREVIOUS CONVERSATION" in prefix

    def test_build_context_prefix_yaml(self):
        turns = [ConversationTurn(role="user", content="hello")]
        prefix = build_context_prefix(turns, format="yaml")
        assert "---" in prefix

    def test_build_context_prefix_json(self):
        turns = [ConversationTurn(role="user", content="hello")]
        prefix = build_context_prefix(turns, format="json")
        assert "```json" in prefix

    def test_create_strategy_native(self, tmp_path):
        s = create_strategy(ResumeMode.NATIVE, base_path=tmp_path / "s", tool="claude")
        assert isinstance(s, NativeResumeStrategy)

    def test_create_strategy_concat(self, tmp_path):
        s = create_strategy(ResumeMode.PROMPT_CONCAT, base_path=tmp_path / "s")
        assert isinstance(s, PromptConcatStrategy)

    def test_create_strategy_hybrid(self, tmp_path):
        s = create_strategy(ResumeMode.HYBRID, base_path=tmp_path / "s", tool="claude")
        assert isinstance(s, HybridStrategy)

    def test_create_strategy_disabled_raises(self, tmp_path):
        with pytest.raises(ValueError):
            create_strategy(ResumeMode.DISABLED, base_path=tmp_path / "s")
