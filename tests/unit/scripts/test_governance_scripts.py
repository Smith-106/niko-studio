from __future__ import annotations

import importlib.util
import io
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path
from types import ModuleType

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def load_script_module(relative_path: str, module_name: str) -> ModuleType:
    script_path = PROJECT_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_authority_alignment_checker_passes_current_repo() -> None:
    module = load_script_module(
        "scripts/check_authority_alignment.py",
        "test_check_authority_alignment_current_repo",
    )

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        exit_code = module.main()

    payload = json.loads(buffer.getvalue())

    assert exit_code == 0
    assert payload["status"] == "PASS"
    assert payload["failed_rules"] == 0
    assert payload["checked_rules"] >= 20
    assert ".github/workflows/external-release-gate.yml" in payload["checked_files"]


def test_delivery_gate_rules_cover_authority_alignment_contract() -> None:
    module = load_script_module(
        "scripts/delivery_gate.py",
        "test_delivery_gate_rule_contract",
    )

    rule_map = {(rule.file_path, rule.needle, rule.must_exist) for rule in module.RULES}

    assert (
        ".github/workflows/external-release-gate.yml",
        "python scripts/check_authority_alignment.py",
        True,
    ) in rule_map
    assert (
        ".github/workflows/external-release-gate.yml",
        "npm run validate:package:dry-run",
        True,
    ) in rule_map
    assert (
        ".github/workflows/external-release-gate.yml",
        "uses: ./.github/workflows/writing-helper-acceptance.yml",
        True,
    ) in rule_map
    assert (
        "src-ts/mcp/routes/content.ts",
        r"pattern: /^\/chat\/stream$/",
        True,
    ) in rule_map
    assert (
        "src-ts/mcp/routes/platform.ts",
        r"pattern: /^\/metrics$/, handler: metricsEndpoint",
        True,
    ) in rule_map
    assert (
        ".github/workflows/writing-helper-acceptance.yml",
        "workflow_call:",
        True,
    ) in rule_map
    assert (
        "docs/release/RELEASE_NOTES.md",
        "用于内部验证；main 分支仍保留 authority alignment 与选定契约的阻断门禁",
        True,
    ) in rule_map
    assert (
        "docs/release/SIGN_OFF.md",
        "certificateThumbprint",
        True,
    ) in rule_map
    assert (
        "docs/SECURITY_VISIBILITY.md",
        "workflow / runtime / docs authority alignment 锚点",
        True,
    ) in rule_map
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"authority_alignment_signal"' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )
    assert any(
        file_path == "scripts/release_check_summary.py"
        and '"desktop_packaging_dry_run"' in needle
        and must_exist
        for file_path, needle, must_exist in rule_map
    )


def test_delivery_gate_passes_current_repo() -> None:
    module = load_script_module(
        "scripts/delivery_gate.py",
        "test_delivery_gate_current_repo",
    )

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        exit_code = module.main()

    output = buffer.getvalue()

    assert exit_code == 0
    assert "delivery gate: ok" in output


def test_authority_alignment_signal_helper_returns_fail_for_nonzero_exit() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_authority_fail",
    )

    status, exit_code, detail = module.authority_alignment_signal(
        1,
        {
            "checked_rules": 20,
            "passed_rules": 19,
            "failed_rules": 1,
            "checked_files": ["README.md"],
            "mismatches": ["README.md: missing anchor"],
        },
        None,
    )

    assert status == "FAIL"
    assert exit_code == 1
    assert "failed_rules=1" in detail
    assert "mismatches=README.md: missing anchor" in detail


def test_authority_alignment_signal_helper_returns_pass_for_clean_payload() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_authority_pass",
    )

    status, exit_code, detail = module.authority_alignment_signal(
        0,
        {
            "status": "PASS",
            "checked_rules": 20,
            "passed_rules": 20,
            "failed_rules": 0,
            "checked_files": ["README.md", "docs/INDEX.md"],
            "mismatches": [],
        },
        None,
    )

    assert status == "PASS"
    assert exit_code == 0
    assert "checked_rules=20" in detail
    assert "failed_rules=0" in detail
    assert "checked_files=2" in detail
