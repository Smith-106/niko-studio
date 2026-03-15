# -*- coding: utf-8 -*-


def test_contract_with_terminal_contract_defaults_and_non_dict_legacy(monkeypatch):
    import src.mcp.contract as contract_module

    # Bypass ensure_contract_payload so we can explicitly exercise defaults + legacy normalization.
    monkeypatch.setattr(contract_module, "_with_contract", lambda payload: dict(payload))

    result = contract_module._with_terminal_contract({"legacy_contract_fields": "invalid"})
    assert result["decision"] == "go"
    assert result["terminal"] == "done"
    assert result["legacy_contract_fields"]["terminal"] == "done"


def test_contract_normalize_schema_version_falls_back_to_constant(monkeypatch):
    import src.mcp.contract as contract_module

    # Force all candidates to be blank/None so the loop doesn't early-return.
    monkeypatch.setattr(contract_module, "ANALYSIS_SCHEMA_VERSION", "")

    assert contract_module._normalize_schema_version({}, {}) == ""


def test_contract_normalize_quality_payload_handles_non_dict_contract_payload(monkeypatch):
    import src.mcp.contract as contract_module

    monkeypatch.setattr(contract_module, "ensure_contract_payload", lambda _payload: "bad")

    normalized = contract_module._normalize_quality_payload({"metrics": {}})
    assert isinstance(normalized, dict)
    assert "analysis_schema_version" in normalized
