# -*- coding: utf-8 -*-
"""
Integration Tests - Session Resume (IMPL-006)

Tests for SessionManager + ResumeStrategy functionality.
"""

import pytest
import json
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch
import sys

src_path = Path(__file__).parent.parent.parent / "src"
sys.path.insert(0, str(src_path))


class TestResumeStrategyBasic:
    """Basic ResumeStrategy tests."""

    def test_resume_mode_enum(self):
        """Test ResumeMode enum values."""
        from src.workflow.session.resume_strategy import ResumeMode

        assert ResumeMode.NATIVE.value == "native"
        assert ResumeMode.PROMPT_CONCAT.value == "prompt-concat"
        assert ResumeMode.HYBRID.value == "hybrid"
        assert ResumeMode.DISABLED.value == "disabled"

    def test_conversation_turn_serialization(self):
        """Test ConversationTurn to_dict and from_dict."""
        from src.workflow.session.resume_strategy import ConversationTurn

        turn = ConversationTurn(
            role="user",
            content="Hello",
            timestamp=datetime.now()
        )

        data = turn.to_dict()
        assert data["role"] == "user"
        assert data["content"] == "Hello"

        restored = ConversationTurn.from_dict(data)
        assert restored.role == turn.role
        assert restored.content == turn.content

    def test_session_context_serialization(self):
        """Test SessionContext to_dict and from_dict."""
        from src.workflow.session.resume_strategy import (
            SessionContext,
            ConversationTurn,
            ResumeMode
        )

        context = SessionContext(
            session_id="test-session",
            history=[
                ConversationTurn(role="user", content="Hello"),
                ConversationTurn(role="assistant", content="Hi there"),
            ],
            resume_mode=ResumeMode.NATIVE
        )

        data = context.to_dict()
        assert data["session_id"] == "test-session"
        assert len(data["history"]) == 2

        restored = SessionContext.from_dict(data)
        assert restored.session_id == context.session_id
        assert len(restored.history) == 2


class TestNativeResumeStrategy:
    """NativeResumeStrategy tests."""

    def test_native_strategy_initialization(self, tmp_path):
        """Test NativeResumeStrategy initialization."""
        from src.workflow.session.resume_strategy import NativeResumeStrategy

        strategy = NativeResumeStrategy(base_path=tmp_path / "sessions")

        assert strategy.base_path.exists()
        assert strategy.checkpoints_path.exists()

    def test_native_strategy_can_resume_false_for_new(self, tmp_path):
        """Test can_resume returns False for non-existent session."""
        from src.workflow.session.resume_strategy import NativeResumeStrategy

        strategy = NativeResumeStrategy(base_path=tmp_path / "sessions")

        result = strategy.can_resume("nonexistent-session")
        assert result is False

    def test_native_strategy_save_checkpoint(self, tmp_path):
        """Test checkpoint saving."""
        from src.workflow.session.resume_strategy import NativeResumeStrategy

        strategy = NativeResumeStrategy(base_path=tmp_path / "sessions")

        checkpoint_id = strategy.save_checkpoint(
            session_id="test-session",
            state={"step": 1, "data": "test"}
        )

        assert checkpoint_id is not None

        # Verify checkpoint exists
        checkpoints = strategy.list_checkpoints("test-session")
        assert len(checkpoints) >= 1


class TestPromptConcatStrategy:
    """PromptConcatResumeStrategy tests."""

    def test_prompt_concat_strategy_initialization(self, tmp_path):
        """Test PromptConcatResumeStrategy initialization."""
        from src.workflow.session.resume_strategy import PromptConcatResumeStrategy

        strategy = PromptConcatResumeStrategy(base_path=tmp_path / "sessions")
        assert strategy is not None

    def test_prompt_concat_can_resume(self, tmp_path):
        """Test can_resume checks for history file."""
        from src.workflow.session.resume_strategy import PromptConcatResumeStrategy

        strategy = PromptConcatResumeStrategy(base_path=tmp_path / "sessions")

        # No history file -> can't resume
        result = strategy.can_resume("no-history-session")
        assert result is False


class TestHybridResumeStrategy:
    """HybridResumeStrategy tests."""

    def test_hybrid_strategy_initialization(self, tmp_path):
        """Test HybridResumeStrategy initialization."""
        from src.workflow.session.resume_strategy import HybridResumeStrategy

        strategy = HybridResumeStrategy(base_path=tmp_path / "sessions")
        assert strategy is not None

    def test_hybrid_strategy_fallback(self, tmp_path):
        """Test hybrid strategy falls back correctly."""
        from src.workflow.session.resume_strategy import HybridResumeStrategy

        strategy = HybridResumeStrategy(base_path=tmp_path / "sessions")

        # Should not raise for non-existent session
        result = strategy.can_resume("fallback-test-session")
        assert isinstance(result, bool)


class TestSessionManagerIntegration:
    """SessionManager integration tests."""

    def test_session_manager_imports(self):
        """Test SessionManager can be imported."""
        from src.workflow.session.session_manager import SessionManager
        assert SessionManager is not None

    def test_session_manager_initialization(self, tmp_path):
        """Test SessionManager initialization."""
        from src.workflow.session.session_manager import SessionManager

        manager = SessionManager(base_path=tmp_path / "sessions")
        assert manager is not None

    def test_session_manager_create_session(self, tmp_path):
        """Test creating a new session."""
        from src.workflow.session.session_manager import SessionManager

        manager = SessionManager(base_path=tmp_path / "sessions")

        session = manager.create_session(
            project_id="test-project",
            goal="Test session goal"
        )

        assert session is not None
        assert "session_id" in session or hasattr(session, 'session_id')

    def test_session_manager_list_sessions(self, tmp_path):
        """Test listing sessions."""
        from src.workflow.session.session_manager import SessionManager

        manager = SessionManager(base_path=tmp_path / "sessions")

        # Create a session first
        manager.create_session(project_id="list-test", goal="Test listing")

        sessions = manager.list_sessions()
        assert isinstance(sessions, list)


class TestCheckpointManagement:
    """Checkpoint management integration tests."""

    def test_checkpoint_state_serialization(self):
        """Test CheckpointState serialization."""
        from src.workflow.session.resume_strategy import (
            CheckpointState,
            ConversationTurn
        )

        checkpoint = CheckpointState(
            checkpoint_id="cp-001",
            session_id="session-001",
            created_at=datetime.now(),
            workflow_step="step-1",
            state_data={"key": "value"},
            history_snapshot=[
                ConversationTurn(role="user", content="test")
            ]
        )

        data = checkpoint.to_dict()
        assert data["checkpoint_id"] == "cp-001"

        restored = CheckpointState.from_dict(data)
        assert restored.checkpoint_id == checkpoint.checkpoint_id
        assert len(restored.history_snapshot) == 1

    def test_get_latest_checkpoint(self, tmp_path):
        """Test getting latest checkpoint."""
        from src.workflow.session.resume_strategy import NativeResumeStrategy

        strategy = NativeResumeStrategy(base_path=tmp_path / "sessions")

        # Save multiple checkpoints
        strategy.save_checkpoint("multi-cp-session", {"step": 1})
        strategy.save_checkpoint("multi-cp-session", {"step": 2})

        latest = strategy.get_latest_checkpoint("multi-cp-session")
        assert latest is not None
        assert latest.state_data.get("step") == 2
