"""
TokenService Tests

Tests for TokenService: token estimation, cost calculation, budget control,
usage recording/querying, and factory functions.
"""

import os
import tempfile
from unittest.mock import MagicMock, patch
import pytest
from src.services.token_service import (
    MODEL_PRICING,
    MODEL_ENCODINGS,
    TokenUsage,
    BudgetStatus,
    TokenService,
    get_token_service,
    reset_token_service,
)


# ============================================================
# Module-level constants
# ============================================================

class TestModelPricing:

    def test_has_default(self):
        assert "default" in MODEL_PRICING

    def test_gpt4o_pricing(self):
        p = MODEL_PRICING["gpt-4o"]
        assert "input" in p
        assert "output" in p
        assert p["input"] > 0
        assert p["output"] > 0

    def test_claude_pricing(self):
        assert "claude-3-5-sonnet" in MODEL_PRICING

    def test_gemini_pricing(self):
        assert "gemini-2.0-flash" in MODEL_PRICING


class TestModelEncodings:

    def test_has_default(self):
        assert "default" in MODEL_ENCODINGS

    def test_gpt4o_encoding(self):
        assert MODEL_ENCODINGS["gpt-4o"] == "o200k_base"

    def test_gpt4_encoding(self):
        assert MODEL_ENCODINGS["gpt-4"] == "cl100k_base"


# ============================================================
# Dataclasses
# ============================================================

class TestTokenUsage:

    def test_fields(self):
        from datetime import datetime
        usage = TokenUsage(
            session_id="s1",
            model="gpt-4o",
            input_tokens=100,
            output_tokens=50,
            cost=0.001,
            timestamp=datetime.now(),
        )
        assert usage.session_id == "s1"
        assert usage.model == "gpt-4o"
        assert usage.input_tokens == 100
        assert usage.output_tokens == 50


class TestBudgetStatus:

    def test_fields(self):
        status = BudgetStatus(
            session_id="s1",
            total_cost=1.0,
            total_input_tokens=1000,
            total_output_tokens=500,
            budget=10.0,
            remaining=9.0,
            usage_percent=10.0,
            request_count=5,
        )
        assert status.remaining == 9.0
        assert status.usage_percent == 10.0


class TestTokenServiceInitializationExtra:

    def test_init_uses_default_db_path_when_none(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        svc = TokenService(db_path=None)
        try:
            assert svc.db_path.as_posix().endswith(".writing/token_usage.db")
        finally:
            svc.close()

    def test_init_uses_config_default_budget(self, tmp_path):
        cfg = MagicMock()
        cfg.agent.max_cost_per_session = 88.0
        svc = TokenService(db_path=str(tmp_path / "cfg_budget.db"), config=cfg)
        try:
            assert svc._default_budget == 88.0
        finally:
            svc.close()


class TestTokenServiceEncoderFallbackExtra:

    def test_get_encoder_import_error_returns_none(self, tmp_path):
        svc = TokenService(db_path=str(tmp_path / "encoder_import_err.db"))
        try:
            with patch("builtins.__import__", side_effect=ImportError("no tiktoken")):
                assert svc._get_encoder("gpt-4o") is None
        finally:
            svc.close()

    def test_estimate_tokens_encode_exception_fallback(self, tmp_path):
        svc = TokenService(db_path=str(tmp_path / "encode_exc.db"))
        try:
            broken_encoder = MagicMock()
            broken_encoder.encode.side_effect = RuntimeError("encode fail")
            with patch.object(svc, "_get_encoder", return_value=broken_encoder):
                text = "Hello 你好"
                tokens = svc.estimate_tokens(text, model="gpt-4o")
            assert tokens == int(2 / 1.5 + (len(text) - 2) / 4)
        finally:
            svc.close()


    def test_get_encoder_generic_exception_returns_none(self, tmp_path):
        svc = TokenService(db_path=str(tmp_path / "encoder_generic_err.db"))
        try:
            fake_tiktoken = MagicMock()
            fake_tiktoken.get_encoding.side_effect = RuntimeError("boom")

            import builtins
            original_import = builtins.__import__

            def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
                if name == "tiktoken":
                    return fake_tiktoken
                return original_import(name, globals, locals, fromlist, level)

            with patch("builtins.__import__", side_effect=_fake_import):
                assert svc._get_encoder("gpt-4o") is None
        finally:
            svc.close()


    def test_get_usage_summary_group_by_day(self, tmp_path):
        svc = TokenService(db_path=str(tmp_path / "summary_day.db"))
        try:
            svc.record_usage(0, 1.0, "gpt-4o", session_id="s1", input_tokens=100, output_tokens=50)
            summary = svc.get_usage_summary(session_id="s1", group_by="day")
            assert len(summary) == 1
            assert "day" in summary[0]
            assert summary[0]["total_cost"] == pytest.approx(1.0)
        finally:
            svc.close()


# ============================================================
# TokenService
# ============================================================

class TestTokenService:

    @pytest.fixture
    def service(self, tmp_path):
        db_path = str(tmp_path / "test_tokens.db")
        svc = TokenService(db_path=db_path)
        yield svc
        svc.close()

    # --- Token Estimation ---

    def test_estimate_tokens_empty(self, service):
        assert service.estimate_tokens("") == 0

    def test_estimate_tokens_english_approx(self, service):
        # Without tiktoken, falls back to approximation: len / 4
        text = "hello world test"
        tokens = service.estimate_tokens(text, model="unknown-model-xyz")
        assert tokens > 0

    def test_estimate_tokens_chinese_approx(self, service):
        # Chinese chars: count / 1.5
        text = "你好世界"
        tokens = service.estimate_tokens(text, model="unknown-model-xyz")
        assert tokens > 0

    def test_estimate_tokens_mixed(self, service):
        text = "Hello 你好"
        tokens = service.estimate_tokens(text, model="unknown-model-xyz")
        assert tokens > 0

    # --- Message Estimation ---

    def test_estimate_messages_basic(self, service):
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"},
        ]
        tokens = service.estimate_messages(messages, model="unknown-model-xyz")
        # At minimum: 2 * 3 (per message) + 3 (end) + content tokens
        assert tokens >= 9

    def test_estimate_messages_with_name(self, service):
        messages = [
            {"role": "user", "content": "Hello", "name": "Alice"},
        ]
        tokens = service.estimate_messages(messages, model="unknown-model-xyz")
        assert tokens > 6  # 3 (msg) + 3 (end) + content + 1 (name) + name tokens

    def test_estimate_messages_multimodal(self, service):
        messages = [
            {"role": "user", "content": [
                {"text": "Describe this"},
                {"image_url": "http://example.com/img.png"},
            ]},
        ]
        tokens = service.estimate_messages(messages, model="unknown-model-xyz")
        # Should include 85 for image
        assert tokens >= 85

    def test_estimate_messages_empty_content(self, service):
        messages = [{"role": "user", "content": ""}]
        tokens = service.estimate_messages(messages, model="unknown-model-xyz")
        assert tokens == 6  # 3 per message + 3 end

    # --- Cost Estimation ---

    def test_estimate_cost_known_model(self, service):
        # gpt-4o: input=2.50, output=10.00 per 1M tokens
        cost = service.estimate_cost(1_000_000, 1_000_000, "gpt-4o")
        assert cost == pytest.approx(12.50, abs=0.01)

    def test_estimate_cost_small(self, service):
        cost = service.estimate_cost(1000, 500, "gpt-4o")
        assert cost > 0
        assert cost < 1.0

    def test_estimate_cost_zero_tokens(self, service):
        cost = service.estimate_cost(0, 0, "gpt-4o")
        assert cost == 0.0

    def test_estimate_cost_unknown_model(self, service):
        cost = service.estimate_cost(1000, 500, "unknown-model")
        # Uses default pricing
        assert cost > 0

    # --- Model Pricing ---

    def test_get_model_pricing_exact(self, service):
        pricing = service.get_model_pricing("gpt-4o")
        assert pricing == MODEL_PRICING["gpt-4o"]

    def test_get_model_pricing_prefix(self, service):
        # "gpt-4o-2024" should match "gpt-4o" via prefix
        pricing = service.get_model_pricing("gpt-4o-2024-08-06")
        assert pricing == MODEL_PRICING["gpt-4o"]

    def test_get_model_pricing_default(self, service):
        pricing = service.get_model_pricing("totally-unknown")
        assert pricing == MODEL_PRICING["default"]

    # --- List Models ---

    def test_list_models(self, service):
        models = service.list_models()
        assert len(models) > 0
        # "default" should be excluded
        names = [m["model"] for m in models]
        assert "default" not in names
        # Each entry has required keys
        for m in models:
            assert "model" in m
            assert "input_price" in m
            assert "output_price" in m
            assert "encoding" in m

    # --- Budget Control ---

    def test_set_and_get_budget(self, service):
        service.set_budget("session-1", 25.0)
        assert service.get_budget("session-1") == 25.0

    def test_get_budget_default(self, service):
        budget = service.get_budget("nonexistent")
        assert budget == 10.0  # default

    def test_check_budget_within(self, service):
        assert service.check_budget(5.0, budget=10.0) is True

    def test_check_budget_exceeded(self, service):
        assert service.check_budget(15.0, budget=10.0) is False

    def test_check_budget_exact(self, service):
        assert service.check_budget(10.0, budget=10.0) is True

    def test_check_budget_with_session(self, service):
        service.set_budget("s1", 10.0)
        service.record_usage(0, 3.0, "gpt-4o", session_id="s1", input_tokens=1000, output_tokens=500)
        # remaining = 10 - 3 = 7
        assert service.check_budget(5.0, session_id="s1") is True
        assert service.check_budget(8.0, session_id="s1") is False

    # --- Budget Status ---

    def test_get_budget_status_empty(self, service):
        status = service.get_budget_status("empty-session")
        assert status.total_cost == 0
        assert status.request_count == 0
        assert status.remaining == 10.0

    def test_get_budget_status_with_usage(self, service):
        service.set_budget("s2", 20.0)
        service.record_usage(0, 5.0, "gpt-4o", session_id="s2", input_tokens=1000, output_tokens=500)
        service.record_usage(0, 3.0, "gpt-4o", session_id="s2", input_tokens=800, output_tokens=200)
        status = service.get_budget_status("s2")
        assert status.total_cost == pytest.approx(8.0)
        assert status.remaining == pytest.approx(12.0)
        assert status.request_count == 2
        assert status.usage_percent == pytest.approx(40.0)

    def test_get_budget_status_default_session(self, service):
        status = service.get_budget_status()
        assert status.session_id == "default"

    # --- Record Usage ---

    def test_record_usage_with_tokens(self, service):
        service.record_usage(0, 1.0, "gpt-4o", session_id="s1", input_tokens=100, output_tokens=50)
        history = service.get_usage_history(session_id="s1")
        assert len(history) == 1
        assert history[0].input_tokens == 100
        assert history[0].output_tokens == 50

    def test_record_usage_auto_split(self, service):
        # When only total tokens given, splits 70/30
        service.record_usage(1000, 1.0, "gpt-4o", session_id="s1")
        history = service.get_usage_history(session_id="s1")
        assert history[0].input_tokens == 700
        assert history[0].output_tokens == 300

    def test_record_usage_default_session(self, service):
        service.record_usage(100, 0.01, "gpt-4o")
        history = service.get_usage_history(session_id="default")
        assert len(history) == 1

    # --- Usage History ---

    def test_get_usage_history_limit(self, service):
        for i in range(5):
            service.record_usage(100, 0.01, "gpt-4o", session_id="s1", input_tokens=50, output_tokens=50)
        history = service.get_usage_history(session_id="s1", limit=3)
        assert len(history) == 3

    def test_get_usage_history_all(self, service):
        service.record_usage(100, 0.01, "gpt-4o", session_id="s1", input_tokens=50, output_tokens=50)
        service.record_usage(100, 0.01, "gpt-4o", session_id="s2", input_tokens=50, output_tokens=50)
        history = service.get_usage_history()
        assert len(history) == 2

    # --- Usage Summary ---

    def test_get_usage_summary_by_model(self, service):
        service.record_usage(0, 1.0, "gpt-4o", session_id="s1", input_tokens=100, output_tokens=50)
        service.record_usage(0, 2.0, "gpt-4o", session_id="s1", input_tokens=200, output_tokens=100)
        service.record_usage(0, 0.5, "claude-3-5-sonnet", session_id="s1", input_tokens=50, output_tokens=25)
        summary = service.get_usage_summary(session_id="s1", group_by="model")
        assert len(summary) == 2
        # gpt-4o should have higher total_cost
        gpt_entry = next(s for s in summary if s["model"] == "gpt-4o")
        assert gpt_entry["total_cost"] == pytest.approx(3.0)
        assert gpt_entry["request_count"] == 2

    def test_get_usage_summary_by_session(self, service):
        service.record_usage(0, 1.0, "gpt-4o", session_id="s1", input_tokens=100, output_tokens=50)
        service.record_usage(0, 2.0, "gpt-4o", session_id="s2", input_tokens=100, output_tokens=50)
        summary = service.get_usage_summary(group_by="session")
        assert len(summary) == 2

    # --- Clear Usage ---

    def test_clear_session_usage(self, service):
        service.record_usage(0, 1.0, "gpt-4o", session_id="s1", input_tokens=100, output_tokens=50)
        service.record_usage(0, 2.0, "gpt-4o", session_id="s1", input_tokens=200, output_tokens=100)
        deleted = service.clear_session_usage("s1")
        assert deleted == 2
        history = service.get_usage_history(session_id="s1")
        assert len(history) == 0

    def test_clear_nonexistent_session(self, service):
        deleted = service.clear_session_usage("nonexistent")
        assert deleted == 0

    # --- Close ---

    def test_close(self, service):
        service.close()
        assert service._db is None

    def test_close_idempotent(self, service):
        service.close()
        service.close()  # Should not raise


# ============================================================
# Factory Functions
# ============================================================

class TestFactoryFunctions:

    def test_get_token_service_singleton(self, tmp_path):
        reset_token_service()
        db_path = str(tmp_path / "factory_test.db")
        svc1 = get_token_service(db_path=db_path)
        svc2 = get_token_service()
        assert svc1 is svc2
        reset_token_service()

    def test_reset_token_service(self, tmp_path):
        reset_token_service()
        db_path = str(tmp_path / "reset_test.db")
        svc1 = get_token_service(db_path=db_path)
        reset_token_service()
        svc2 = get_token_service(db_path=db_path)
        assert svc1 is not svc2
        reset_token_service()

    def test_reset_when_none(self):
        reset_token_service()
        reset_token_service()  # Should not raise
