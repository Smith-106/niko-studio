from src.services.token_service import TokenService, MODEL_PRICING


def test_estimate_tokens_empty_text_returns_zero(tmp_path):
    service = TokenService(db_path=str(tmp_path / "token.db"))
    assert service.estimate_tokens("") == 0
    service.close()


def test_estimate_tokens_fallback_approximation(tmp_path, monkeypatch):
    service = TokenService(db_path=str(tmp_path / "token.db"))
    monkeypatch.setattr(service, "_get_encoder", lambda _model: None)

    text = "中文测试ABCD"
    tokens = service.estimate_tokens(text)

    expected = int(4 / 1.5 + 4 / 4)
    assert tokens == expected
    service.close()


def test_estimate_messages_supports_multimodal_parts(tmp_path):
    service = TokenService(db_path=str(tmp_path / "token.db"))

    messages = [
        {
            "role": "user",
            "content": [
                {"text": "hello"},
                {"image_url": "https://image"},
            ],
            "name": "alice",
        }
    ]

    estimated = service.estimate_messages(messages)
    assert estimated >= 90
    service.close()


def test_estimate_cost_and_model_pricing_fallback(tmp_path):
    service = TokenService(db_path=str(tmp_path / "token.db"))

    cost = service.estimate_cost(input_tokens=1000, output_tokens=500, model="gpt-4o")
    assert cost == 0.0075

    unknown_pricing = service.get_model_pricing("unknown-model")
    assert unknown_pricing == MODEL_PRICING["default"]

    prefix_pricing = service.get_model_pricing("gpt-4o-custom")
    assert prefix_pricing == MODEL_PRICING["gpt-4o"]
    service.close()


def test_budget_status_and_check_budget(tmp_path):
    service = TokenService(db_path=str(tmp_path / "token.db"))

    service.set_budget("s1", 1.0)
    service.record_usage(tokens=1000, cost=0.25, model="gpt-4o", session_id="s1")

    status = service.get_budget_status("s1")
    assert status.total_cost == 0.25
    assert status.remaining == 0.75
    assert status.request_count == 1

    assert service.check_budget(estimated_cost=0.5, session_id="s1") is True
    assert service.check_budget(estimated_cost=0.8, session_id="s1") is False
    service.close()


def test_usage_history_summary_and_clear(tmp_path):
    service = TokenService(db_path=str(tmp_path / "token.db"))

    service.record_usage(tokens=200, cost=0.01, model="gpt-4o", session_id="s2")
    service.record_usage(tokens=100, cost=0.005, model="gpt-4o-mini", session_id="s2")

    history = service.get_usage_history(session_id="s2")
    assert len(history) == 2

    summary = service.get_usage_summary(session_id="s2", group_by="model")
    assert len(summary) == 2
    assert {item["model"] for item in summary} == {"gpt-4o", "gpt-4o-mini"}

    deleted = service.clear_session_usage("s2")
    assert deleted == 2
    assert service.get_usage_history(session_id="s2") == []
    service.close()
