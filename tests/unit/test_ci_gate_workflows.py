# -*- coding: utf-8 -*-
"""CI workflow gate configuration tests."""

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


def test_integration_workflow_external_quality_job_keeps_strict_codecov():
    content = _read(".github/workflows/integration-tests.yml")
    assert "external-quality-signals" in content
    assert "run_codecov: true" in content
    assert "codecov_fail_ci_if_error: true" in content

