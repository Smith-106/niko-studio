# -*- coding: utf-8 -*-
"""CI workflow gate configuration tests."""

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (PROJECT_ROOT / path).read_text(encoding="utf-8")


def test_external_release_gate_resolves_codecov_strict_mode_from_token():
    content = _read(".github/workflows/external-release-gate.yml")
    assert "Resolve Codecov strict mode" in content
    assert "if [ -n \"$CODECOV_TOKEN\" ] && [ \"${{ inputs.codecov_fail_ci_if_error }}\" = \"true\" ]; then" in content
    assert "CODECOV_TOKEN is missing, downgrade strict Codecov gate for this run" in content


def test_external_release_gate_uses_resolved_fail_ci_flag_output():
    content = _read(".github/workflows/external-release-gate.yml")
    assert "fail_ci_if_error: ${{ steps.codecov_mode.outputs.fail_ci_if_error }}" in content


def test_integration_workflow_keeps_i18n_check_warn_mode():
    content = _read(".github/workflows/integration-tests.yml")
    assert "i18n-check" in content
    assert "continue-on-error: true" in content
    assert "python scripts/check_i18n_keys.py" in content


def test_integration_workflow_defines_three_level_gate_lanes():
    content = _read(".github/workflows/integration-tests.yml")
    assert "p2-baseline-soft-warn" in content
    assert "p2-high-risk-soft-fail" in content
    assert "p2-selected-hard-fail" in content


def test_integration_workflow_gate_lane_policies_match_expected():
    content = _read(".github/workflows/integration-tests.yml")
    assert "p2-baseline-soft-warn:" in content
    assert "continue-on-error: true" in content
    assert "p2-high-risk-soft-fail:" in content
    assert "p2-selected-hard-fail:" in content
    # Workflow includes i18n-check in needs for p2-selected-hard-fail
    assert "needs: [tests, desktop-build, i18n-check, p2-baseline-soft-warn, p2-high-risk-soft-fail]" in content


def test_integration_workflow_contains_all_four_contract_groups():
    content = _read(".github/workflows/integration-tests.yml")
    assert "test_workflow_engine.py -k \"decision\"" in content
    assert "test_gateway_stream.py -k \"contract\"" in content
    assert "src/api/client.test.ts" in content
    assert "src/components/EvaluationPanel.test.tsx" in content


def test_integration_workflow_hard_gate_runs_selected_contracts():
    content = _read(".github/workflows/integration-tests.yml")
    assert "Run P2 selected hard gate contracts" in content
    assert "pytest tests/unit/workflow/test_workflow_engine.py -k \"decision\" -q" in content
    assert "pytest tests/unit/mcp/test_gateway_stream.py -k \"contract\" -q" in content
    assert "npm --prefix desktop run test -- src/api/client.test.ts src/components/EvaluationPanel.test.tsx" in content


def test_tauri_proxy_supports_frontend_used_http_methods():
    client_ts = _read("desktop/src/api/client.ts")
    tauri_main_rs = _read("desktop/src-tauri/src/main.rs")

    frontend_methods = set(re.findall(r"callApi\([^\n]*,\s*'(GET|POST|PUT|PATCH|DELETE)'", client_ts))
    tauri_methods = set(re.findall(r'"(GET|POST|PUT|PATCH|DELETE)"\s*=>', tauri_main_rs))

    assert "PUT" in frontend_methods
    assert frontend_methods.issubset(tauri_methods)


def test_gateway_base_source_contract_parity_between_frontend_and_tauri():
    client_ts = _read("desktop/src/api/client.ts")
    tauri_main_rs = _read("desktop/src-tauri/src/main.rs")

    frontend_env_keys = set(re.findall(r"env\.(NIKO_GATEWAY_URL|VITE_NIKO_GATEWAY_URL)", client_ts))
    tauri_env_keys = set(re.findall(r'"(NIKO_GATEWAY_URL|VITE_NIKO_GATEWAY_URL)"', tauri_main_rs))

    assert frontend_env_keys == {"NIKO_GATEWAY_URL", "VITE_NIKO_GATEWAY_URL"}
    assert frontend_env_keys.issubset(tauri_env_keys)


def test_gateway_cors_allow_methods_includes_put_contract():
    gateway_py = _read("src/mcp/gateway.py")

    match = re.search(r"allow_methods=\[(?P<body>[^\]]+)\]", gateway_py)
    assert match is not None
    methods = set(re.findall(r'"(GET|POST|PUT|PATCH|DELETE|OPTIONS)"', match.group("body")))

    assert "PUT" in methods
