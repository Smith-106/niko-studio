# -*- coding: utf-8 -*-
"""CI workflow gate configuration tests."""

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (PROJECT_ROOT / path).read_text(encoding="utf-8")


def test_external_release_gate_enforces_codecov_token_when_strict():
    content = _read(".github/workflows/external-release-gate.yml")
    assert "Enforce Codecov token for strict external gate" in content
    assert "inputs.run_codecov && inputs.codecov_fail_ci_if_error" in content
    assert "CODECOV_TOKEN is required when codecov_fail_ci_if_error=true" in content


def test_external_release_gate_uses_strict_fail_ci_flag_directly():
    content = _read(".github/workflows/external-release-gate.yml")
    assert "fail_ci_if_error: ${{ inputs.codecov_fail_ci_if_error }}" in content


def test_integration_workflow_external_quality_job_keeps_strict_codecov():
    content = _read(".github/workflows/integration-tests.yml")
    assert "external-quality-signals" in content
    assert "run_codecov: true" in content
    assert "codecov_fail_ci_if_error: true" in content
